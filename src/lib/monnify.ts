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

// Monnify SDK script URLs (corrected endpoints)
const SCRIPT_URLS = [
    `${MONNIFY_BASE_URL}/merchant/scripts/monnify-direct.js`,  // Correct primary endpoint
    `https://widget.monnify.com/monnify.js`,                   // Widget fallback
];

let scriptLoadAttempted = false;
let scriptLoadSuccess = false;
let currentScriptIndex = 0;

function loadScript(index: number, opts: MonnifyCheckoutOptions) {
    if (index >= SCRIPT_URLS.length) {
        alert(
            'Failed to load Monnify payment SDK from all endpoints.\n\n' +
            'Please verify your Monnify configuration:\n' +
            `API Key: ${MONNIFY_API_KEY.slice(0, 8)}...\n` +
            `Contract: ${MONNIFY_CONTRACT_CODE.slice(0, 6)}...\n` +
            `Base URL: ${MONNIFY_BASE_URL}\n\n` +
            'Check your .env file and make sure these values are correct.'
        );
        opts.onClose();
        return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URLS[index];
    script.async = true;
    script.onload = () => {
        scriptLoadAttempted = true;
        scriptLoadSuccess = true;
        // Small delay to ensure SDK is fully initialized
        setTimeout(() => launch(opts), 300);
    };
    script.onerror = () => {
        console.warn(`Monnify script URL ${SCRIPT_URLS[index]} failed, trying next...`);
        currentScriptIndex++;
        loadScript(currentScriptIndex, opts);
    };
    document.body.appendChild(script);
}

/**
 * Open Monnify inline checkout in a popup
 */
export function openMonnifyCheckout(opts: MonnifyCheckoutOptions) {
    if (!MONNIFY_API_KEY || !MONNIFY_CONTRACT_CODE) {
        alert(
            'Monnify is not configured.\n\n' +
            'Please add these to your .env file:\n' +
            'VITE_MONNIFY_API_KEY=your_api_key\n' +
            'VITE_MONNIFY_CONTRACT_CODE=your_contract_code\n\n' +
            `Current API Key: ${MONNIFY_API_KEY || '(empty)'}\n` +
            `Current Contract: ${MONNIFY_CONTRACT_CODE || '(empty)'}`
        );
        opts.onClose();
        return;
    }

    console.log('Monnify configured with:', {
        apiKey: MONNIFY_API_KEY.slice(0, 8) + '...',
        contractCode: MONNIFY_CONTRACT_CODE.slice(0, 6) + '...',
        baseUrl: MONNIFY_BASE_URL,
        amount: opts.amount,
        email: opts.customerEmail,
        reference: opts.paymentReference,
    });

    if (!window.MonnifySDK && !scriptLoadAttempted) {
        currentScriptIndex = 0;
        loadScript(0, opts);
    } else if (window.MonnifySDK) {
        launch(opts);
    } else {
        // Script was attempted but failed - retry with next URL
        currentScriptIndex++;
        loadScript(currentScriptIndex, opts);
    }
}

function launch(opts: MonnifyCheckoutOptions) {
    if (!window.MonnifySDK) {
        alert(
            'Monnify SDK is not available.\n\n' +
            'This could be due to:\n' +
            '1. An ad blocker blocking the Monnify script\n' +
            '2. A firewall or network restriction\n' +
            '3. The Monnify servers being unreachable\n\n' +
            'Try disabling your ad blocker or use a different network.'
        );
        opts.onClose();
        return;
    }

    try {
        console.log('Initializing Monnify checkout...');
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
                console.log('Monnify onComplete:', response);
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
                console.log('Monnify onClose');
                opts.onClose();
            },
        });
    } catch (err) {
        console.error('Monnify error:', err);
        alert(
            'Monnify initialization failed.\n\n' +
            'Error: ' + (err instanceof Error ? err.message : 'Unknown error') + '\n\n' +
            'Please try again. If the problem persists, contact support.'
        );
        opts.onClose();
    }
}

export function generateReference(prefix = 'ksu'): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${ts}_${rand}`;
}