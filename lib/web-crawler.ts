import * as cheerio from 'cheerio';

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  html: string;
  timestamp: Date;
}

/**
 * Crawl a website and extract content using Cheerio (lightweight, no browser needed)
 * This is much lighter than Playwright and suitable for cloud deployments
 */
export async function crawlWebsite(url: string, options?: {
  timeout?: number;
}): Promise<CrawlResult> {
  try {
    const timeout = options?.timeout || 30000;
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    console.log('Web Crawler: Fetching', url);
    
    // Fetch the HTML content
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Parse HTML with Cheerio
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Başlıksız';
    
    // Remove script and style elements
    $('script, style, noscript, iframe').remove();
    
    // Try to get main content area first
    let content = '';
    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main-content', '#main-content'];
    
    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        if (content.trim().length > 100) {
          break;
        }
      }
    }
    
    // If no main content found, use body
    if (!content || content.trim().length < 100) {
      content = $('body').text();
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Limit content size (keep first 100k characters for AI processing)
    if (content.length > 100000) {
      content = content.substring(0, 100000) + '\n[... içerik devam ediyor ...]';
    }

    // Extract tables for better rule extraction
    const tables: string[] = [];
    $('table').each((_, table) => {
      const tableText = $(table).text().trim();
      if (tableText.length > 50) {
        tables.push(tableText);
      }
    });

    // Add tables to content if found
    if (tables.length > 0) {
      content += '\n\n[ÖNEMLİ TABLOLAR]\n' + tables.join('\n\n---\n\n');
    }

    return {
      url,
      title,
      content,
      html,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Web Crawler: Error crawling website', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Web sitesi yanıt vermedi (timeout)');
      }
      if (error.message.includes('fetch')) {
        throw new Error(`Web sitesine erişilemedi: ${error.message}`);
      }
    }
    
    throw new Error(`Web sitesi crawl edilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
}

/**
 * Extract tables from HTML content
 */
export function extractTables(html: string): string[] {
  const $ = cheerio.load(html);
  const tables: string[] = [];
  
  $('table').each((_, table) => {
    const tableText = $(table).text().trim();
    if (tableText.length > 50) {
      tables.push(tableText);
    }
  });
  
  return tables;
}
