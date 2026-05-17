import Link from "next/link";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="text-center max-w-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-8">
          <FileQuestion className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-3">404</h1>
        <h2 className="text-xl font-semibold mb-2">Sayfa Bulunamadı</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="javascript:history.back()">
              <ArrowLeft className="mr-2 h-4 w-4" />Geri Dön
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />Ana Panel
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
