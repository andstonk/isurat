import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @ffmpeg-installer/ffmpeg resolves its binary path at runtime via
  // __dirname + os.platform()-based string concatenation. If webpack bundles
  // it, __dirname no longer matches the real node_modules layout on disk and
  // the lookup fails (confirmed locally). serverExternalPackages keeps it as
  // a real `require()` against the actual install location instead.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  // File tracing still needs telling explicitly to bring the binary along
  // for deployment, since the dynamic path construction can't be followed
  // statically — without this the Linux ffmpeg binary gets dropped from the
  // deployed serverless function even though it's an external.
  outputFileTracingIncludes: {
    "/api/jobs/process/route": ["./node_modules/.pnpm/@ffmpeg-installer+linux-x64@*/node_modules/@ffmpeg-installer/linux-x64/**/*"],
  },
};

export default nextConfig;
