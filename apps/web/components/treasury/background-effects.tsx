"use client";

const customStyles: Record<string, React.CSSProperties> = {
  bgGridAnimated: {
    backgroundSize: "50px 50px",
    backgroundImage: `
      linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
    `,
  },
};

export function BackgroundEffects() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{ backgroundColor: "var(--nocturne-bg)" }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={customStyles.bgGridAnimated}
      />
      <div
        className="absolute -top-1/2 -left-1/2 h-96 w-96 rounded-full"
        style={{
          background: "var(--nocturne-cyan)",
          mixBlendMode: "screen",
          filter: "blur(128px)",
          opacity: 0.2,
          animation: "blob 7s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-1/4 -right-10 h-96 w-96 rounded-full"
        style={{
          background: "#6366f1",
          mixBlendMode: "screen",
          filter: "blur(128px)",
          opacity: 0.2,
          animation: "blob 7s ease-in-out 2s infinite",
        }}
      />
      <div
        className="absolute -bottom-1/4 left-1/4 h-[500px] w-[500px] rounded-full"
        style={{
          background: "#0284c7",
          mixBlendMode: "screen",
          filter: "blur(150px)",
          opacity: 0.1,
          animation: "blob 7s ease-in-out 4s infinite",
        }}
      />
    </div>
  );
}
