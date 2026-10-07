export function PronuviaLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="20" fill="#3DBFA4" />
        <path
          d="M20 8C14 8 10 13 10 18C10 23 14 26 20 26C20 26 20 32 20 32C20 32 30 26 30 18C30 13 26 8 20 8Z"
          fill="white"
        />
        <circle cx="20" cy="18" r="5" fill="#3DBFA4" />
      </svg>
      <span
        style={{ fontFamily: "Georgia, serif", letterSpacing: "0.02em" }}
        className="text-gray-800 font-semibold text-xl"
      >
        Pronuvia
      </span>
    </div>
  );
}
