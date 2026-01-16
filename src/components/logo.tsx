import Link from "next/link";

interface LogoProps {
  href?: string;
}

export function Logo({ href = "/" }: LogoProps) {
  return (
    <Link href={href} className="flex items-center space-x-2">
      <span className="text-xl font-bold text-primary">DSV Prog2</span>
    </Link>
  );
}
