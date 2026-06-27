import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// List of common disposable email domains to block bot spam and temporary addresses
const BANNED_EMAIL_DOMAINS = new Set([
  'temp-mail.org', 'tempmail.com', 'mailinator.com', 'yopmail.com', '10minutemail.com',
  'guerrillamail.com', 'dispostable.com', 'getairmail.com', 'burnermail.io', 'trashmail.com',
  'tempmailaddress.com', 'sharklasers.com', 'guerrillamailblock.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'grr.la', 'pokemail.net', 'spam4.me',
  'disposable.com', 'duck.com', 'anonaddy.com', 'simplelogin.co', 'maildrop.cc'
]);

// Simple in-memory rate limiting map to prevent API abuse, spam submissions, and email depletion
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour window
const MAX_REQUESTS_PER_WINDOW = 5; // Limit to 5 signup attempts per hour per IP

export async function POST(request: Request) {
  try {
    const { email, website, turnstileToken } = await request.json();

    // 1. Honeypot check: If the hidden 'website' field is populated, we suspect a bot.
    // Return a dummy success message to trick the bot without wasting resources or DB records.
    if (website) {
      console.warn('🤖 Bot registration blocked via honeypot field.');
      return NextResponse.json({
        success: true,
        message: 'Successfully joined the waitlist!',
      });
    }

    // 2. IP Retrieval and Rate Limiting Check
    // Cloudflare uses 'cf-connecting-ip' which is secure and cannot be spoofed from outside CF.
    const ip = request.headers.get('cf-connecting-ip') || 
               request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               'unknown';
               
    const now = Date.now();
    const limitData = rateLimitMap.get(ip);

    if (limitData) {
      if (now > limitData.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      } else if (limitData.count >= MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          { error: 'Too many signup attempts. Please try again in an hour.' },
          { status: 429 }
        );
      } else {
        limitData.count += 1;
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // 3. Email validation and sanitization
    if (!email || typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const domain = sanitizedEmail.split('@')[1];

    if (BANNED_EMAIL_DOMAINS.has(domain)) {
      return NextResponse.json(
        { error: 'Disposable email addresses are not allowed. Please use a work or personal email.' },
        { status: 400 }
      );
    }

    // 4. Cloudflare Turnstile Bot Protection
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '1x00000000000000000000000000000000'; // fallback to Cloudflare test secret key

    // Verify Turnstile Token (required in production, or if key is explicitly configured)
    if (process.env.NODE_ENV === 'production' || process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Security verification is required. Please refresh the page and try again.' },
          { status: 400 }
        );
      }

      try {
        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            secret: turnstileSecret,
            response: turnstileToken,
            remoteip: ip,
          }),
        });

        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
          console.warn('🤖 Bot registration blocked via Cloudflare Turnstile token validation failure.', verifyData);
          return NextResponse.json(
            { error: 'Security validation failed. Please solve the captcha challenge again.' },
            { status: 400 }
          );
        }
      } catch (verifyError) {
        console.error('Turnstile connection error:', verifyError);
        // Do not fail in case of remote API connection failure during development, but fail in production
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { error: 'Security verification service unavailable. Please try again later.' },
            { status: 500 }
          );
        }
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendAudienceId = process.env.RESEND_AUDIENCE_ID;

    const isMissingEnv = !supabaseUrl || !supabaseServiceKey || !resendApiKey;

    if (isMissingEnv) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRITICAL: Database or Mailer environmental variables are missing in production mode.');
        return NextResponse.json(
          { error: 'Server configuration error. Please contact administration.' },
          { status: 500 }
        );
      }

      console.warn(
        '⚠️ Running waitlist API in SIMULATION mode because environmental variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY) are missing.'
      );
      // Simulate network delay to check spinner animations on frontend
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed (simulation mode).',
        simulated: true,
      });
    }

    if (!resendAudienceId && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ RESEND_AUDIENCE_ID environment variable is missing. Resend contact creation will be skipped.');
    }

    // Initialize Supabase Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert into 'waitlist' table
    const { error: dbError } = await supabase
      .from('waitlist')
      .insert([{ email: sanitizedEmail }]);

    if (dbError) {
      // Check for duplicate key error (PostgreSQL error code 23505 or string match)
      if (dbError.code === '23505' || dbError.message?.toLowerCase().includes('unique')) {
        return NextResponse.json(
          { error: 'You are already on the waitlist!' },
          { status: 409 }
        );
      }
      console.error('Supabase DB Error:', dbError);
      return NextResponse.json(
        { error: 'Failed to join the waitlist. Please try again.' },
        { status: 500 }
      );
    }

    // Initialize Resend and send welcome email
    const resend = new Resend(resendApiKey);

    try {
      await resend.emails.send({
        from: 'Hello@loryians.com', // Replace with your domain in production
        to: sanitizedEmail,
        subject: "Welcome to Loryians — You're on the list! 🚀",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #4C1D95; background-color: #FAF5FF; border-radius: 12px; border: 1px solid #E9D5FF;">
            <div style="text-align: center; margin-bottom: 30px;">
              <span style="font-size: 28px; font-weight: 800; color: #7C3AED; letter-spacing: -0.05em;">Loryians</span>
            </div>
            <h1 style="font-size: 24px; font-weight: 700; color: #4C1D95; margin-bottom: 16px; text-align: center; line-height: 1.2;">Welcome to Loryians! 🚀</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #581C87; margin-bottom: 24px; text-align: center;">
              Thank you for joining our waitlist. We are absolutely thrilled to have you here!
            </p>
            <div style="background-color: #FFFFFF; border-radius: 8px; padding: 20px; border: 1px solid #E9D5FF; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 15px; color: #6D28D9; margin: 0; font-weight: 600;">Welcome to Loryians, and we hope you become a Loryian!</p>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #581C87; margin-bottom: 24px;">
              Loryians is the minimalist project management workspace built to help solo founders and small teams plan, track, and ship faster without the standard SaaS bloat. 
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #581C87; margin-bottom: 24px;">
              We are rolling out early access invitations in stages. Keep an eye on your inbox — we will send you another email as soon as your workspace is ready.
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #581C87; margin-bottom: 32px;">
              In the meantime, join our discussions and check out updates on Twitter/X <a href="https://x.com/loryians" style="color: #7C3AED; text-decoration: underline; font-weight: 600;">@loryians</a>.
            </p>
            <hr style="border: 0; border-top: 1px solid #E9D5FF; margin-bottom: 20px;" />
            <p style="font-size: 12px; color: #A78BFA; text-align: center; margin: 0;">
              Loryians Inc. &copy; 2026. All rights reserved.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Resend Email Send Error:', emailError);
    }

    // Add contact to Resend Audience if configured
    if (resendAudienceId) {
      try {
        await resend.contacts.create({
          email: sanitizedEmail,
          audienceId: resendAudienceId,
        });
      } catch (contactError) {
        console.error('Resend Contact Creation Error:', contactError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
    });
  } catch (error) {
    console.error('Waitlist API Handler Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
