import { LLMRequest, LLMResponse, LLMRequestType } from '../../models/LLMModels';
import { ILLMProvider, LLMCapabilities, ProviderResourceUsage } from '../LLMService';

/**
 * Ollama provider for local LLM server on macOS
 * Connects to locally running Ollama instance
 */
export class OllamaProvider implements ILLMProvider {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;
  private resourceUsage: ProviderResourceUsage;
  private isConnected = false;

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.2:3b') {
    this.baseUrl = baseUrl;
    this.model = model;
    this.resourceUsage = {
      memoryUsage: 0,
      cpuUsage: 0,
      requestCount: 0,
      averageLatency: 0
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama server is running with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // Check if our preferred model is available
        const hasModel = data.models?.some((m: any) => m.name.includes(this.model.split(':')[0]));
        this.isConnected = true;
        return hasModel;
      }
      
      return false;
    } catch (error) {
      this.isConnected = false;
      if ((error as Error).name === 'AbortError') {
        console.warn('Ollama availability check timed out');
      }
      return false;
    }
  }

  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected && !(await this.isAvailable())) {
        throw new Error('Ollama server not available');
      }

      const response = await this.callOllama(request);
      const processingTime = Date.now() - startTime;
      
      this.updateResourceUsage(processingTime);
      
      return {
        requestId: this.generateResponseId(),
        response: response.text,
        confidence: response.confidence,
        tokensUsed: response.tokensUsed,
        processingTime,
        model: `Ollama-${this.model}`,
        fallbackUsed: false
      };
    } catch (error) {
      console.error('Ollama processing failed:', error);
      throw new Error(`Ollama processing failed: ${(error as Error).message}`);
    }
  }

  private async callOllama(request: LLMRequest): Promise<{text: string, confidence: number, tokensUsed: number}> {
    const prompt = this.buildPrompt(request);
    
    const requestBody = {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: request.temperature || 0.7,
        num_predict: request.maxTokens || 512,
        top_p: 0.9,
        top_k: 40
      }
    };

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for generation

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.response || '',
        confidence: this.calculateConfidence(data),
        tokensUsed: data.eval_count || 0
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error('Ollama request timed out after 15 seconds');
      }
      throw error;
    }
  }

  private buildPrompt(request: LLMRequest): string {
    const parts = [];
    
    // Add system prompt if provided
    if (request.systemPrompt) {
      parts.push(`<|system|>\n${request.systemPrompt}\n<|end|>`);
    }
    
    // Add context if provided
    if (request.context) {
      parts.push(`<|context|>\n${request.context}\n<|end|>`);
    }
    
    // Add note content if provided
    if (request.noteContent) {
      parts.push(`<|note|>\n${request.noteContent}\n<|end|>`);
    }
    
    // Add user prompt
    if (request.userPrompt) {
      parts.push(`<|user|>\n${request.userPrompt}\n<|end|>`);
    }
    
    parts.push('<|assistant|>');
    
    return parts.join('\n\n');
  }

  private calculateConfidence(data: any): number {
    // Calculate confidence based on response quality indicators
    let confidence = 0.8; // Base confidence
    
    // Adjust based on response length (longer responses often more confident)
    if (data.response && data.response.length > 50) {
      confidence += 0.1;
    }
    
    // Adjust based on evaluation metrics if available
    if (data.eval_duration && data.eval_count) {
      const tokensPerSecond = data.eval_count / (data.eval_duration / 1000000000);
      if (tokensPerSecond > 10) {
        confidence += 0.05; // Fast generation often indicates confidence
      }
    }
    
    return Math.min(0.95, confidence);
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 4096,
      supportedRequestTypes: [
        LLMRequestType.CONTENT_ANALYSIS,
        LLMRequestType.TITLE_GENERATION,
        LLMRequestType.CLASSIFICATION,
        LLMRequestType.EXPLANATION,
        LLMRequestType.SUMMARIZATION,
        LLMRequestType.RELATIONSHIP_DETECTION
      ],
      supportsStreaming: true,
      requiresNetwork: false, // Local network only
      privacyCompliant: true
    };
  }

  getResourceUsage(): ProviderResourceUsage {
    return { ...this.resourceUsage };
  }

  private updateResourceUsage(processingTime: number): void {
    this.resourceUsage.requestCount++;
    
    // Update average latency
    const totalLatency = this.resourceUsage.averageLatency * (this.resourceUsage.requestCount - 1) + processingTime;
    this.resourceUsage.averageLatency = totalLatency / this.resourceUsage.requestCount;
    
    // Estimate resource usage (would be measured in real implementation)
    this.resourceUsage.memoryUsage = 500; // MB (Ollama typically uses more memory)
    this.resourceUsage.cpuUsage = Math.min(40, Math.random() * 50); // Percentage
  }

  private generateResponseId(): string {
    return `ollama_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    this.isConnected = false;
    console.log('Ollama provider shut down');
  }

  /**
   * Check available models on the Ollama server
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        return data.models?.map((m: any) => m.name) || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Set the model to use for requests
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Pull a new model from Ollama registry
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to pull model:', error);
      return false;
    }
  }
}