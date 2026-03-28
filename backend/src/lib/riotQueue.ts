import https from 'https';

interface QueuedRequest {
  path: string;
  host: string;
  apiKey: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export class RiotRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private blockedUntil = 0;

  enqueue(path: string, host: string, apiKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ path, host, apiKey, resolve, reject });
      if (!this.processing) {
        this.processNext();
      }
    });
  }

  private processNext(): void {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    const now = Date.now();
    if (now < this.blockedUntil) {
      const delay = this.blockedUntil - now;
      setTimeout(() => this.processNext(), delay);
      return;
    }

    const item = this.queue.shift()!;
    this.executeRequest(item);
  }

  private executeRequest(item: QueuedRequest): void {
    const options: https.RequestOptions = {
      hostname: item.host,
      path: item.path,
      method: 'GET',
      headers: {
        'X-Riot-Token': item.apiKey,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(Buffer.from(c)));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');

        if (res.statusCode === 429) {
          const retryAfter = parseInt(res.headers['retry-after'] as string ?? '1', 10);
          this.blockedUntil = Date.now() + retryAfter * 1000;
          // Re-enqueue at the front and retry after the block window
          this.queue.unshift(item);
          setTimeout(() => this.processNext(), retryAfter * 1000);
          return;
        }

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            item.resolve(JSON.parse(body));
          } catch (parseErr) {
            item.reject(parseErr);
          }
        } else {
          const err = new Error(`HTTP ${res.statusCode}: ${body} [${item.host}${item.path}]`);
          (err as any).status = res.statusCode;
          item.reject(err);
        }

        this.processNext();
      });
    });

    req.on('error', (e) => {
      item.reject(e);
      this.processNext();
    });

    req.end();
  }
}
