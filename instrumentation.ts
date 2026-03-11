export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getSecret } = await import("@/lib/ssm");

    const keys = ["AUTH_USERNAME", "AUTH_PASSWORD"] as const;
    for (const key of keys) {
      if (!process.env[key]) {
        const value = await getSecret(key);
        if (value) {
          process.env[key] = value;
        }
      }
    }
  }
}
