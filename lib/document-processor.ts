import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

// Lazy load pdf-parse v1.1.1 (simpler API)
let pdfParseFn: any = null;

async function loadPdfParse() {
  if (pdfParseFn) {
    return pdfParseFn;
  }
  
  try {
    console.log('loadPdfParse: Starting import of pdf-parse v1.1.1');
    const pdfParseModule = await import('pdf-parse');
    
    // pdf-parse v1.1.1 exports a function directly or as default
    pdfParseFn = pdfParseModule.default || pdfParseModule;
    
    if (typeof pdfParseFn !== 'function') {
      throw new Error('pdf-parse is not a function');
    }
    
    console.log('loadPdfParse: pdf-parse loaded successfully');
    return pdfParseFn;
  } catch (error) {
    console.error('loadPdfParse: Error loading pdf-parse', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export interface ProcessedDocument {
  text: string;
  metadata: {
    pages?: number;
    wordCount: number;
    language?: string;
  };
}

export async function processDocument(
  filePath: string,
  mimeType: string
): Promise<ProcessedDocument> {
  const fileBuffer = await fs.readFile(filePath);

  switch (mimeType) {
    case 'application/pdf':
      return await processPDF(fileBuffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return await processDOCX(fileBuffer);

    case 'text/plain':
    case 'text/markdown':
      return await processText(fileBuffer.toString());

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

async function processPDF(buffer: Buffer): Promise<ProcessedDocument> {
  try {
    console.log('processPDF: Starting PDF processing with pdf-parse v1.1.1, buffer size:', buffer.length);
    
    const pdfParse = await loadPdfParse();
    if (!pdfParse || typeof pdfParse !== 'function') {
      throw new Error('pdf-parse could not be loaded');
    }
    
    console.log('processPDF: Parsing PDF buffer');
    const result = await pdfParse(buffer);
    
    const text = result.text || '';
    const numPages = result.numpages || 0;
    const wordCount = text.split(/\s+/).filter((word: string) => word.length > 0).length;
    
    console.log('processPDF: PDF parsed successfully', {
      textLength: text.length,
      pages: numPages,
      wordCount,
    });

    return {
      text,
      metadata: {
        pages: numPages,
        wordCount,
      },
    };
  } catch (error) {
    console.error('processPDF: Error occurred', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Return empty text if parsing fails (file will still be saved)
    return {
      text: '',
      metadata: {
        pages: 0,
        wordCount: 0,
      },
    };
  }
}

async function processDOCX(buffer: Buffer): Promise<ProcessedDocument> {
  try {
    console.log('processDOCX: Starting DOCX processing, buffer size:', buffer.length);
    
    // First, verify it's actually a DOCX file by checking the ZIP signature
    // DOCX files are ZIP archives, so they start with PK (50 4B)
    const zipSignature = buffer.slice(0, 2);
    if (zipSignature[0] !== 0x50 || zipSignature[1] !== 0x4B) {
      throw new Error('Bu dosya DOCX formatında değil. DOCX dosyaları ZIP arşivi formatındadır. Lütfen dosyayı Word\'de açıp "Farklı Kaydet" ile DOCX formatında kaydedin.');
    }
    
    // Try to extract raw text first
    let result;
    try {
      result = await mammoth.extractRawText({ buffer });
    } catch (mammothError) {
      console.error('processDOCX: extractRawText failed, trying HTML conversion', mammothError);
      // If extractRawText fails, try HTML conversion
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        // Extract text from HTML
        const htmlText = htmlResult.value
          .replace(/<[^>]*>/g, ' ') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        if (htmlText && htmlText.length > 0) {
          const wordCount = htmlText.split(/\s+/).filter((word: string) => word.length > 0).length;
          return {
            text: htmlText,
            metadata: { wordCount },
          };
        }
      } catch (htmlError) {
        console.error('processDOCX: HTML conversion also failed', htmlError);
        throw new Error('Word dosyası işlenemedi. Dosya bozuk olabilir veya korumalı olabilir. Lütfen dosyayı Word\'de açıp tekrar kaydedin.');
      }
      throw mammothError;
    }
    
    const text = result.value || '';
    
    // Check if we have text
    if (!text || text.trim().length === 0) {
      // Try HTML conversion as fallback
      console.log('processDOCX: No text extracted with extractRawText, trying HTML conversion');
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        const htmlText = htmlResult.value
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (htmlText && htmlText.length > 0) {
          const wordCount = htmlText.split(/\s+/).filter((word: string) => word.length > 0).length;
          return {
            text: htmlText,
            metadata: { wordCount },
          };
        }
      } catch (htmlError) {
        console.error('processDOCX: HTML conversion fallback failed', htmlError);
      }
      
      throw new Error('Word dosyasından metin çıkarılamadı. Dosya boş olabilir veya korumalı olabilir.');
    }
    
    const wordCount = text.split(/\s+/).filter((word: string) => word.length > 0).length;
    
    console.log('processDOCX: DOCX processed successfully', {
      textLength: text.length,
      wordCount,
    });

    return {
      text,
      metadata: {
        wordCount,
      },
    };
  } catch (error) {
    console.error('processDOCX: Error occurred', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('body element') || error.message.includes('docx file')) {
        throw new Error('Word dosyası geçersiz veya bozuk. Lütfen dosyayı Word\'de açıp "Farklı Kaydet" ile DOCX formatında kaydedin. Alternatif: Dosyayı PDF formatına çevirip yükleyebilirsiniz.');
      }
      // Re-throw our custom error messages
      if (error.message.includes('DOCX formatında değil') || 
          error.message.includes('bozuk olabilir') ||
          error.message.includes('metin çıkarılamadı')) {
        throw error;
      }
      throw new Error(`Word dosyası işlenirken hata oluştu: ${error.message}`);
    }
    
    throw new Error('Word dosyası işlenirken bilinmeyen bir hata oluştu.');
  }
}

async function processText(text: string): Promise<ProcessedDocument> {
  const wordCount = text.split(/\s+/).filter((word: string) => word.length > 0).length;

  return {
    text,
    metadata: {
      wordCount,
    },
  };
}

