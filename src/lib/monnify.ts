// Monnify payment helper - client side
// Monnify's inline checkout (Monnify JS SDK) loads a script and opens a popup

declare global {
    interface Window {
        MonnifySDK?: any;
    }
}

const MONNIFY_API_KEY = (import.meta.env.VITE_MONNIFY_API_KEY as string) || '';
const MONNIFY_CONTRACT_CODE = (import.meta.env.VITE_MONNIFY_CONTRACT_CODE as string) || '';
const MONNIFY_BASE_URL = (import.meta.env.VITE_MONNIFY_BASE_URL as string) || 'https://sandbox.monnify.com';

export interface MonnifyCheckoutOptions {
    amount: number; // in kobo (Naira * 100)
    customerName: string;
    customerEmail: string;
    paymentReference: string;
    paymentDescription: string;
    metadata?: Record<string, any>;
    onSuccess: (response: { paymentReference: string; transactionReference: string; amount: number; channel: string }) => void;
    onClose: () => void;
}

/**
 * Open Monnify inline checkout in a popup
 */
export function openMonnifyCheckout(opts: MonnifyCheckoutOptions) {
    if (!MONNIFY_API_KEY || !MONNIFY_CONTRACT_CODE) {
        alert('Monnify is not configured. Please add VITE_MONNIFY_API_KEY and VITE_MONNIFY_CONTRACT_CODE to your .env file.');
        opts.onClose();
        return;
    }

    if (!window.MonnifySDK) {
        const script = document.createElement('script');
        // Use the correct Monnify script URL - monnify.js not monnify-direct.js
        script.src = `${MONNIFY_BASE_URL}/merchant/scripts/monnify.js`;
        script.async = true;
        script.onload = () => {
            // Small delay to ensure SDK is fully initialized
            setTimeout(() => launch(opts), 200);
        };
        script.onerror = () => {
            alert(
                'Failed to load Monnify payment SDK.\n\n' +
                'Possible fixes:\n' +
                '1. Check your internet connection\n' +
                '2. If using sandbox keys, ensure VITE_MONNIFY_BASE_URL=https://sandbox.monnify.com\n' +
                '3. If using live keys, use VITE_MONNIFY_BASE_URL=https://app.monnify.com\n' +
                '4. Make sure your API key and contract code are correct in .env'
            );
            opts.onClose();
        };
        document.body.appendChild(script);
    } else {
        launch(opts);
    }
}

function launch(opts: MonnifyCheckoutOptions) {
    if (!window.MonnifySDK) {
        alert('Monnify SDK failed to initialize. Please refresh and try again.');
        opts.onClose();
        return;
    }

    try {
        window.MonnifySDK.initialize({
            amount: opts.amount,
            currency: 'NGN',
            customerName: opts.customerName,
            customerEmail: opts.customerEmail,
            paymentReference: opts.paymentReference,
            paymentDescription: opts.paymentDescription,
            contractCode: MONNIFY_CONTRACT_CODE,
            apiKey: MONNIFY_API_KEY,
            metadata: opts.metadata || {},
            onComplete: (response: any) => {
                if (response.status === 'SUCCESS' || response.paymentStatus === 'PAID') {
                    opts.onSuccess({
                        paymentReference: response.paymentReference,
                        transactionReference: response.transactionReference,
                        amount: response.amountPaid || opts.amount,
                        channel: response.paymentMethod || 'unknown',
                    });
                } else {
                    opts.onClose();
                }
            },
            onClose: () => {
                opts.onClose();
            },
        });
    } catch (err) {
        console.error('Monnify error:', err);
        alert('Monnify initialization failed. Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        opts.onClose();
    }
}

export function generateReference(prefix = 'ksu'): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${ts}_${rand}`;
}