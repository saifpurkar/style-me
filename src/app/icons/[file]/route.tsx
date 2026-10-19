import { ImageResponse } from "next/og";

// App icons for installing Style Me on a phone, drawn from code so there are no image files
// to keep in step: a paper "S" with a brass bar on charcoal. The artwork stays inside the
// central area so it is safe for Android's rounded and circular "maskable" crops.
export const dynamic = "force-static";

const SIZES = [180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((s) => ({ file: `${s}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const size = Number(file.replace(/\.png$/, ""));
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#33302b",
        }}
      >
        <div style={{ display: "flex", fontSize: size * 0.56, lineHeight: 1, color: "#f6f3ec" }}>S</div>
        <div
          style={{
            display: "flex",
            width: size * 0.28,
            height: Math.max(3, size * 0.03),
            marginTop: size * 0.03,
            background: "#b08d57",
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
