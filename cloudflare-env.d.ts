declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    WEALTH_ALLOWED_EMAILS?: string;
    BUCKET?: R2Bucket;
  }
}
