import Link from "next/link";

/** The SwiftLab brand header used across public pages. */
export default function Header() {
  return (
    <header className="brand-header">
      <div className="flex items-center gap-3">
        <div className="brand-mark">SL</div>
        <div>
          <h1 className="m-0 font-poppins text-lg font-semibold">SwiftLab</h1>
          <span className="mt-0.5 block text-xs text-[#BFD6EA]">
            Laboratory Results Portal
          </span>
        </div>
      </div>
      <nav className="text-sm">
        <Link
          href="/"
          className="ml-6 text-[#D7E6F5] no-underline hover:underline"
        >
          Home
        </Link>
      </nav>
    </header>
  );
}
