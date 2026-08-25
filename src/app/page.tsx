import Link from "next/link";
import Header from "@/components/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-24 text-center">
        <p className="eyebrow">SwiftLab · Lab Results Portal</p>
        <h1 className="font-poppins text-4xl font-semibold tracking-tight text-navy-deep">
          Register, track, and get your lab results securely
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          No more queues at the counter. Book your laboratory tests online,
          track their progress with a unique key, and receive your results
          securely.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/order" className="btn btn-primary">
            Request a lab test
          </Link>
          <Link href="/track" className="btn btn-secondary">
            Track an order
          </Link>
        </div>
        <p className="mt-14 text-xs text-muted/70">
          SwiftLab · Secure laboratory results delivery
        </p>
      </main>
    </>
  );
}
