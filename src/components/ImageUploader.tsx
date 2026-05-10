import { useRef, useState } from "react";
import { uploadImage } from "@/lib/imageUpload";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  bucket: "recipe-images" | "comment-images" | "chat-images";
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}

export default function ImageUploader({ bucket, value, onChange, label = "Bild", className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadImage(bucket, file);
      onChange(url);
      toast.success("Bild hochgeladen");
    } catch (e: any) {
      toast.error(e.message ?? "Upload fehlgeschlagen");
    } finally { setBusy(false); }
  };

  return (
    <div className={className}>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="" className="max-h-48 rounded border-2 border-gold/40" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
            aria-label="Entfernen"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handle(f);
          }}
          className={`border-2 border-dashed rounded p-4 text-center transition ${drag ? "border-gold bg-gold/10" : "border-gold/30"}`}
        >
          <p className="text-xs text-surface-foreground/70 mb-2">{label} – Drag & Drop, max 2 MB (JPEG/PNG/WEBP)</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} className="border-gold/40">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1" />} Datei
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => camRef.current?.click()} disabled={busy} className="border-gold/40">
              <Camera className="w-4 h-4 mr-1" /> Kamera
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
        </div>
      )}
    </div>
  );
}
