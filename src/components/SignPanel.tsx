"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rejectContractAction, sendOtpAction, signContractAction } from "@/modules/signing/actions";

const W = 600;
const H = 220;
const faDigits = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export default function SignPanel({ contractId, signerLabel, maskedMobile }: { contractId: number; signerLabel: string; maskedMobile: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [method, setMethod] = useState<"draw" | "upload">("draw");
  const [hasInk, setHasInk] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2a6f";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    setHasInk(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = useCallback(() => {
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, W, H);
    setHasInk(false);
    setUploaded(null);
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError("فقط تصویر PNG یا JPG مجاز است");
    if (file.size > 3 * 1024 * 1024) return setError("حجم تصویر باید کمتر از ۳ مگابایت باشد");
    setError("");
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      const s = Math.min(W / img.width, H / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      setUploaded(c.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const getSignature = () => (method === "upload" ? uploaded : hasInk ? canvasRef.current!.toDataURL("image/png") : null);

  const sendOtp = async () => {
    setError("");
    setBusy(true);
    const res = await sendOtpAction(contractId);
    setBusy(false);
    if (res.seconds) setSeconds(res.seconds);
    if (!res.ok) return setError(res.error || "خطا در ارسال کد");
    setOtpSent(true);
    setDevCode(res.devCode);
  };

  const sign = async () => {
    setError("");
    const signature = getSignature();
    if (!signature) return setError("ابتدا امضای خود را ترسیم یا آپلود کنید");
    if (!agree) return setError("لطفاً تایید مطالعه‌ی قرارداد را علامت بزنید");
    if (!/^\d{5}$/.test(code)) return setError("کد تایید ۵ رقمی را وارد کنید");
    setBusy(true);
    const res = await signContractAction(contractId, { signature, method, agree, code });
    setBusy(false);
    if (!res.ok) return setError(res.error || "خطا در ثبت امضا");
    router.refresh();
  };

  const reject = async () => {
    const reason = window.prompt("دلیل رد قرارداد را بنویسید:");
    if (reason === null) return;
    setBusy(true);
    const res = await rejectContractAction(contractId, reason);
    setBusy(false);
    if (!res.ok) return setError(res.error || "خطا");
    router.refresh();
  };

  return (
    <section className="card no-print space-y-5">
      <div>
        <h2 className="text-lg font-bold">امضای قرارداد — {signerLabel}</h2>
        <p className="text-sm text-slate-500">نوبت امضای شماست. مراحل زیر را تکمیل کنید.</p>
      </div>

      <div>
        <div className="mb-2 flex gap-2">
          {(["draw", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`btn ${method === m ? "btn-primary" : "btn-secondary"}`}
            >
              {m === "draw" ? "ترسیم امضا" : "آپلود تصویر امضا"}
            </button>
          ))}
        </div>

        <div className={method === "draw" ? "" : "hidden"}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-slate-50"
            style={{ aspectRatio: `${W}/${H}`, cursor: "crosshair" }}
          />
          <p className="mt-1 text-xs text-slate-500">با ماوس یا انگشت در کادر بالا امضا کنید.</p>
        </div>

        {method === "upload" && (
          <div className="space-y-2">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0])} className="input" />
            {uploaded && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploaded} alt="پیش‌نمایش امضا" className="max-h-40 rounded-lg border border-slate-200" />
            )}
          </div>
        )}
        <button type="button" onClick={clear} className="btn btn-secondary mt-2 !py-1">
          پاک کردن
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" />
        قرارداد را مطالعه کرده‌ام و با مفاد آن موافقم.
      </label>

      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-bold">تایید هویت با پیامک</h3>
        <p className="text-sm text-slate-500">
          کد تایید به شماره <span dir="ltr" className="font-mono">{maskedMobile}</span> ارسال می‌شود.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={sendOtp} disabled={busy || seconds > 0} className="btn btn-secondary">
            {otpSent ? "ارسال مجدد کد" : "دریافت کد تایید"}
          </button>
          {seconds > 0 && <span className="text-sm text-slate-500">ارسال مجدد تا {faDigits(seconds)} ثانیه دیگر</span>}
        </div>
        {devCode && (
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
            حالت آزمایشی (پنل پیامک متصل نیست): کد شما <b className="font-mono text-base">{faDigits(devCode)}</b> است.
          </p>
        )}
        {otpSent && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            dir="ltr"
            placeholder="_ _ _ _ _"
            className="input max-w-48 text-center font-mono text-lg tracking-widest"
          />
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={sign} disabled={busy} className="btn btn-primary">
          {busy ? "در حال ثبت…" : "امضا و ثبت نهایی"}
        </button>
        <button type="button" onClick={reject} disabled={busy} className="btn btn-secondary text-red-700">
          رد قرارداد
        </button>
      </div>
    </section>
  );
}
