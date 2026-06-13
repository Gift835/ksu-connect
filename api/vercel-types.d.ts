/**
 * Minimal local shim for @vercel/node types.
 * Keeps api/ files compilable without installing the npm package.
 * Replace this file with `npm install --save-dev @vercel/node` once
 * network access is available.
 */
import type { IncomingMessage, ServerResponse } from 'http';

export interface VercelRequest extends IncomingMessage {
    query: Record<string, string | string[]>;
    cookies: Record<string, string>;
    body: any;
}

export interface VercelResponse extends ServerResponse {
    send(body: any): VercelResponse;
    json(jsonBody: any): VercelResponse;
    status(statusCode: number): VercelResponse;
    redirect(statusOrUrl: string | number, url?: string): VercelResponse;
    end(cb?: () => void): this;
    end(chunk: any, cb?: () => void): this;
    end(chunk: any, encoding: string, cb?: () => void): this;
    setHeader(name: string, value: string | number | readonly string[]): this;
}
