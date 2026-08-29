import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Veda AI</h1>
        <p className="text-muted-foreground mt-2">Foundation ready</p>
        <p className="text-muted-foreground text-sm">
          Next.js + TypeScript + Tailwind + shadcn/ui
        </p>
      </div>
      <Button>shadcn/ui Button</Button>
    </main>
  );
}
