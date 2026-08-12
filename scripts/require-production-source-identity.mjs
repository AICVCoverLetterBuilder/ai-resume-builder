const raw = String(process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT || '').trim();

if (!/^[0-9a-f]{7,40}$/iu.test(raw)) {
  throw new Error(
    'Production source identity contract failed: NEXT_PUBLIC_SOURCE_COMMIT_SHORT must be a 7-40 character Git SHA before build.',
  );
}

console.log(`[production-source-identity] sourceCommitShort=${raw.slice(0, 7).toLowerCase()}`);
