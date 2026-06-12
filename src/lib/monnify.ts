// Monnify payment helper - client side
// Monnify's inline checkout (Monnify JS SDK) loads a script and opens a popup
// NOTE: Monnify takes amount in NAIRA (not Kobo)

declare global {
    interface Window {
        MonnifySDK?: any;
    }
}

const MONNIFY_API_KEY = (import.meta.env.VITE_MONNIFY_API_KEY as string) || '';
const MONNIFY_CONTRACT_CODE = (import.meta.env.VITE_MONNIFY_CONTRACT_CODE as string) || '';

export interface MonnifyCheckoutOptions {
    amount: number; // in NAIRA (e.g. 300 for ₦300)
    customerName: string;
    customerEmail: string;
    paymentReference: string;
    paymentDescription: string;
    metadata?: Record<string, any>;
    onSuccess: (response: { paymentReference: string; transactionReference: string; amount: number; channel: string }) => void;
    onClose: () => void;
}

// Monnify SDK script URLs
const SCRIPT_URLS = [
    'https://sdk.monnify.com/plugin/monnify.js',
];

let scriptLoaded = false;
let scriptLoading = false;
const pendingQueue: Array<() => void> = [];

function loadMonnifyScript(): Promise<boolean> {
    return new Promise((resolve) => {
        // Already loaded
        if (scriptLoaded && window.MonnifySDK) {
            resolve(true);
            return;
        }

        // Currently loading — queue up
        if (scriptLoading) {
            pendingQueue.push(() => resolve(!!window.MonnifySDK));
            return;
        }

        scriptLoading = true;

        const tryLoad = (index: number) => {
            if (index >= SCRIPT_URLS.length) {
                scriptLoading = false;
                resolve(false);
                pendingQueue.forEach(fn => fn());
                pendingQueue.length = 0;
                return;
            }

            // Remove old failed script tags
            const existing = document.querySelector(`script[src="${SCRIPT_URLS[index - 1]}"]`);
            if (existing) existing.remove();

            const script = document.createElement('script');
            script.src = SCRIPT_URLS[index];
            script.async = true;
            script.onload = () => {
                scriptLoaded = true;
                scriptLoading = false;
                setTimeout(() => {
                    resolve(!!window.MonnifySDK);
                    pendingQueue.forEach(fn => fn());
                    pendingQueue.length = 0;
                }, 400);
            };
            script.onerror = () => {
                console.warn(`Monnify script URL ${SCRIPT_URLS[index]} failed, trying next...`);
                tryLoad(index + 1);
            };
            document.body.appendChild(script);
        };

        tryLoad(0);
    });
}

/**
 * Open Monnify inline checkout in a popup
 * Amount must be in NAIRA (e.g. 300 for ₦300)
 */
export async function openMonnifyCheckout(opts: MonnifyCheckoutOptions) {
    if (!MONNIFY_API_KEY || !MONNIFY_CONTRACT_CODE) {
        console.error(
            'Monnify is not configured.\n' +
            'VITE_MONNIFY_API_KEY and VITE_MONNIFY_CONTRACT_CODE must be set in .env'
        );
        opts.onClose();
        return;
    }

    console.log('Opening Monnify checkout:', {
        apiKey: MONNIFY_API_KEY.slice(0, 8) + '...',
        contractCode: MONNIFY_CONTRACT_CODE,
        amount: opts.amount + ' NGN',
        email: opts.customerEmail,
        reference: opts.paymentReference,
    });

    const loaded = await loadMonnifyScript();
    if (!loaded || !window.MonnifySDK) {
        console.error('Monnify SDK could not be loaded. Check network/ad-blocker.');
        opts.onClose();
        return;
    }

    try {
        window.MonnifySDK.initialize({
            amount: opts.amount,          // Monnify expects NAIRA
            currency: 'NGN',
            reference: opts.paymentReference,
            customerFullName: opts.customerName,
            customerEmail: opts.customerEmail,
            apiKey: MONNIFY_API_KEY,
            contractCode: MONNIFY_CONTRACT_CODE,
            paymentDescription: opts.paymentDescription,
            metadata: opts.metadata || {},
            isTestMode: MONNIFY_API_KEY.startsWith('MK_TEST_'),              // dynamic based on key prefix
            onLoadStart: () => {
                console.log('Monnify checkout loading...');
            },
            onLoadComplete: () => {
                console.log('Monnify checkout ready');
            },
            onComplete: (response: any) => {
                console.log('Monnify onComplete:', response);
                // paymentStatus can be PAID, PENDING, OVERPAID etc.
                const status = (response.status || response.paymentStatus || '').toUpperCase();
                if (status === 'SUCCESS' || status === 'PAID' || status === 'OVERPAID') {
                    opts.onSuccess({
                        paymentReference: response.paymentReference || opts.paymentReference,
                        transactionReference: response.transactionReference || '',
                        amount: response.amountPaid || opts.amount,
                        channel: response.paymentMethod || 'unknown',
                    });
                } else {
                    console.warn('Monnify payment not completed, status:', status);
                    opts.onClose();
                }
            },
            onClose: () => {
                console.log('Monnify modal closed by user');
                opts.onClose();
            },
        });
    } catch (err) {
        console.error('Monnify initialize error:', err);
        opts.onClose();
    }
}

export function generateReference(prefix = 'ksu'): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${ts}_${rand}`;
}