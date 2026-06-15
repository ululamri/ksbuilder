import { env } from '$env/dynamic/private';

export type BuilderServerConfig = {
  mode: 'local' | 'draft' | 'spark-api';
  apiUrl: string;
  allowedOrigin: string;
  requestTimeoutMs: number;
  forwardedApiCookies: string[];
  dataDir: string;
  adminEmail: string;
  adminPassword: string;
};

export function builderConfig(): BuilderServerConfig {
  const mode: BuilderServerConfig['mode'] = env.SPARK_BUILDER_API_MODE === 'spark-api' ? 'spark-api' : env.SPARK_BUILDER_API_MODE === 'draft' ? 'draft' : 'local';
  const config: BuilderServerConfig = {
    mode,
    apiUrl: (env.SPARK_API_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, ''),
    allowedOrigin: env.SPARK_BUILDER_ALLOWED_ORIGIN ?? 'http://127.0.0.1:5175',
    requestTimeoutMs: Math.max(1_000, Math.min(30_000, Number(env.SPARK_API_TIMEOUT_MS) || 8_000)),
    forwardedApiCookies: (env.SPARK_API_FORWARD_COOKIES ?? 'spark_api_session,__Host-spark_api_session')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
    dataDir: env.SPARK_BUILDER_DATA_DIR ?? './data',
    adminEmail: (env.SPARK_BUILDER_ADMIN_EMAIL ?? 'admin@spark.local').toLowerCase(),
    adminPassword: env.SPARK_BUILDER_ADMIN_PASSWORD ?? 'change-this-password-now'
  };
  if (env.NODE_ENV === 'production' && mode === 'local' && (config.adminPassword === 'change-this-password-now' || config.adminPassword.length < 16)) {
    throw new Error('SPARK_BUILDER_ADMIN_PASSWORD must be a unique value of at least 16 characters in production.');
  }
  return config;
}
