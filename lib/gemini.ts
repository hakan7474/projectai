import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Use gemini-2.5-pro or fallback to gemini-1.5-pro if not available
const chatModel = process.env.AI_CHAT_MODEL || 'gemini-2.5-pro';

export const geminiPro = genAI.getGenerativeModel({ model: chatModel });
export const geminiProVision = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-vision' });

// Upload file to Gemini and analyze it
export async function uploadAndAnalyzeFile(
  fileBuffer: Buffer,
  mimeType: string,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  try {
    console.log('Gemini File API: Starting file upload and analysis', {
      bufferSize: fileBuffer.length,
      mimeType,
      promptLength: prompt.length,
    });

    // Convert buffer to base64
    const base64Data = fileBuffer.toString('base64');
    
    // Use File API to upload and analyze
    // Note: Gemini File API requires uploading file first, then referencing it
    // For now, we'll use inline data with Vision API but with better error handling
    
    const model = geminiProVision;
    
    const generationConfig: any = {};
    if (options?.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    // Check file size (Gemini has limits)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (fileBuffer.length > maxSize) {
      throw new Error(`Dosya çok büyük (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB). Maksimum 20MB olmalı.`);
    }

    console.log('Gemini File API: Calling generateContent with inline data');
    
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig,
    });

    const response = await result.response;
    const text = response.text();

    console.log('Gemini File API: Analysis successful', { textLength: text.length });
    return text;
  } catch (error) {
    console.error('Gemini File API: Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    });
    throw error;
  }
}

// Analyze PDF or image directly with Gemini Vision API
export async function analyzeDocumentWithVision(
  fileBuffer: Buffer,
  mimeType: string,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  try {
    console.log('Gemini Vision: Analyzing document', {
      bufferSize: fileBuffer.length,
      mimeType,
      promptLength: prompt.length,
    });

    // Convert buffer to base64
    const base64Data = fileBuffer.toString('base64');
    
    // Determine MIME type for Gemini Vision API
    // Note: Gemini Vision API supports PDF and images, but NOT Word documents
    let geminiMimeType = mimeType;
    if (mimeType === 'application/pdf') {
      geminiMimeType = 'application/pdf';
    } else if (mimeType.includes('image')) {
      geminiMimeType = mimeType;
    } else if (mimeType.includes('word') || mimeType.includes('msword')) {
      // Word documents are not supported by Vision API
      throw new Error('Word dokümanları Vision API ile desteklenmiyor. Lütfen PDF formatında yükleyin veya metin çıkarma kullanın.');
    } else {
      throw new Error(`Desteklenmeyen MIME tipi: ${mimeType}. Sadece PDF ve görüntü dosyaları desteklenir.`);
    }

    const model = geminiProVision;
    
    const generationConfig: any = {};
    if (options?.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    // Use Vision API with file data
    console.log('Gemini Vision: Calling generateContent', {
      base64Length: base64Data.length,
      geminiMimeType,
      hasGenerationConfig: !!generationConfig,
    });

    let result;
    try {
      result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: geminiMimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig,
      });
      console.log('Gemini Vision: generateContent succeeded');
    } catch (generateError) {
      console.error('Gemini Vision: generateContent failed', {
        error: generateError instanceof Error ? generateError.message : 'Unknown error',
        errorType: generateError?.constructor?.name,
      });
      throw generateError;
    }

    let response;
    try {
      response = await result.response;
      console.log('Gemini Vision: Response received');
    } catch (responseError) {
      console.error('Gemini Vision: Failed to get response', {
        error: responseError instanceof Error ? responseError.message : 'Unknown error',
      });
      throw responseError;
    }

    let text;
    try {
      text = response.text();
      console.log('Gemini Vision: Document analyzed successfully', { textLength: text.length });
    } catch (textError) {
      console.error('Gemini Vision: Failed to extract text', {
        error: textError instanceof Error ? textError.message : 'Unknown error',
        responseType: typeof response,
        responseKeys: response ? Object.keys(response).slice(0, 10) : [],
      });
      throw textError;
    }

    return text;
  } catch (error) {
    console.error('Gemini Vision: Error analyzing document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function generateText(prompt: string, options?: { temperature?: number; maxTokens?: number }) {
  try {
    console.log('Gemini: Generating text', { 
      model: chatModel,
      promptLength: prompt.length, 
      options 
    });
    
    const model = geminiPro;
    
    // Build generation config
    const generationConfig: any = {};
    if (options?.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }
    
    // Use new API format with contents array
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini: Text generated successfully', { textLength: text.length });
    return text;
  } catch (error) {
    console.error('Gemini: Error generating text', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      model: chatModel,
    });
    
    // If gemini-2.5-pro fails, try gemini-1.5-pro as fallback
    if (chatModel === 'gemini-2.5-pro') {
      console.log('Gemini: Trying fallback model gemini-1.5-pro');
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const generationConfig: any = {};
        if (options?.temperature !== undefined) {
          generationConfig.temperature = options.temperature;
        }
        if (options?.maxTokens !== undefined) {
          generationConfig.maxOutputTokens = options.maxTokens;
        }
        const result = await fallbackModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        });
        const response = await result.response;
        const text = response.text();
        console.log('Gemini: Text generated successfully with fallback model', { textLength: text.length });
        return text;
      } catch (fallbackError) {
        console.error('Gemini: Fallback model also failed', fallbackError);
        throw error; // Throw original error
      }
    }
    
    throw error;
  }
}

export async function* generateTextStream(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
) {
  try {
    const model = geminiPro;
    const generationConfig: any = {};
    
    if (options?.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    
    if (options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }
    
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      yield chunkText;
    }
  } catch (error) {
    console.error('Gemini: Error generating text stream', {
      error: error instanceof Error ? error.message : 'Unknown error',
      model: chatModel,
    });
    throw error;
  }
}

export default genAI;
