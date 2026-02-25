import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'none'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"worker-src 'self'",
	"manifest-src 'self'",
].join('; ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	if (!dev) {
		response.headers.set('X-Frame-Options', 'DENY');

		const contentType = response.headers.get('content-type') ?? '';
		if (contentType.includes('text/html')) {
			response.headers.set('Content-Security-Policy', contentSecurityPolicy);
		}
	}

	return response;
};
