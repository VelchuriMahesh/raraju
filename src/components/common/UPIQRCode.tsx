import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Check, Copy, ExternalLink, IndianRupee, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface UPIQRCodeProps {
  upiId: string;
  payeeName: string;
  amount: number;
  invoiceNumber?: string;
}

export const UPIQRCode: React.FC<UPIQRCodeProps> = ({
  upiId,
  payeeName,
  amount,
  invoiceNumber = 'BILL'
}) => {
  const { language } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const cleanUpiId = (upiId || 'raraju@upi').trim();
  const cleanPayee = (payeeName || 'RARAJU ENTERPRISES').trim();
  const transactionNote = `Payment for ${invoiceNumber}`;

  // Standard UPI URI format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(
    cleanPayee
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    QRCode.toDataURL(upiUri, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#0f172a', // Slate-900
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('QR code generation error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [upiUri]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(cleanUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-sm text-center space-y-3">
      {/* Payee Info Banner */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
        <div className="text-left">
          <p className="font-extrabold text-slate-900">{cleanPayee}</p>
          <button
            type="button"
            onClick={handleCopyUpi}
            className="text-[11px] font-mono text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 mt-0.5"
            title="Click to copy UPI ID"
          >
            <span>{cleanUpiId}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
          </button>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Scan to Pay</span>
          <span className="font-mono font-black text-emerald-600 text-sm">₹{amount.toFixed(2)}</span>
        </div>
      </div>

      {/* QR Code Canvas Frame */}
      <div className="w-52 h-52 mx-auto p-2 bg-white border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-inner group">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-[11px] font-bold">Generating QR...</span>
          </div>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="UPI QR Code"
            className="w-full h-full object-contain rounded-xl"
          />
        ) : (
          <div className="text-xs text-rose-500 font-bold">Failed to load QR code</div>
        )}
      </div>

      {/* UPI App Logos Badge */}
      <div className="pt-1 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-bold">
        <span>GPay</span>
        <span>•</span>
        <span>PhonePe</span>
        <span>•</span>
        <span>Paytm</span>
        <span>•</span>
        <span>BHIM UPI</span>
      </div>

      <p className="text-[11px] text-slate-400">
        {language === 'te'
          ? 'ఖచ్చితమైన బిల్లు మొత్తాన్ని చెల్లించడానికి ఏదైనా యూపీఐ యాప్‌తో స్కాన్ చేయండి'
          : 'Scan with any UPI app to pay exact bill amount'}
      </p>
    </div>
  );
};
