import { useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { sessionsApi } from '@/api/sessions';

interface WebcamScannerProps {
  sessionId: string;
  onProductsDetected: (products: any[]) => Promise<void>;
  disabled?: boolean;
}

interface DetectionResult {
  inventory_id: string;
  name: string;
  sku: string;
  confidence: number;
  quantity: number;
  matched_from: string;
}

export function WebcamScanner({
  sessionId,
  onProductsDetected,
  disabled = false,
}: WebcamScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const captureAndDetect = async () => {
    if (!webcamRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Capture image
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture image');
      }

      // Remove data URL prefix to get base64
      const base64Image = imageSrc.replace(/^data:image\/\w+;base64,/, '');

      // Send to backend for detection
      const response = await sessionsApi.detectFromImage(sessionId, base64Image);

      if (response.results && response.results.length > 0) {
        setResults(response.results);
        setShowResults(true);
      } else {
        setError('No products detected in image. Try again.');
      }
    } catch (err) {
      let message = 'Detection failed';

      if (err instanceof Error) {
        const errorMsg = err.message.toLowerCase();

        if (errorMsg.includes('503') || errorMsg.includes('service unavailable')) {
          message = 'Detection service unavailable. Please ensure Ollama is running and healthy.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          message = 'Detection timed out. Try with better lighting or a clearer image.';
        } else if (errorMsg.includes('400') || errorMsg.includes('bad request')) {
          message = 'Invalid image. Please try capturing again.';
        } else if (errorMsg.includes('completed during detection')) {
          message = 'Session was completed while detecting. Please start a new session.';
        } else if (errorMsg.includes('not active')) {
          message = 'Session is not active. Please start a new session.';
        } else if (errorMsg.includes('failed to capture')) {
          message = 'Failed to capture image. Please check camera permissions.';
        } else {
          message = err.message || 'Detection failed. Please try again.';
        }
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = async (product: DetectionResult) => {
    try {
      setLoading(true);
      await onProductsDetected([product]);
      setShowResults(false);
      setResults([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add product';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Webcam Preview */}
      <div className="bg-black rounded-lg overflow-hidden">
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.8}
          width={640}
          height={480}
          videoConstraints={{ facingMode: 'environment' }}
          onUserMediaError={(err) => {
            setWebcamError(
              'Camera access denied. Please enable camera permissions or use manual entry.'
            );
          }}
        />
      </div>

      {/* Detect Button */}
      <button
        onClick={captureAndDetect}
        disabled={loading || disabled}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Detecting...' : 'Detect Products'}
      </button>

      {/* Webcam Error */}
      {webcamError && (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          {webcamError}
        </div>
      )}

      {/* Detection Error */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Detection Results Modal */}
      {showResults && results.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-auto">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">
                Detected Products ({results.length})
              </h3>
            </div>

            <div className="p-4 space-y-2">
              {results.map((product, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectProduct(product)}
                  disabled={loading}
                  className="w-full text-left p-3 border rounded hover:bg-blue-50 disabled:opacity-50"
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-600">SKU: {product.sku}</div>
                  <div className="text-sm text-gray-600">
                    Confidence: {(product.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Detected as: "{product.matched_from}"
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowResults(false)}
                className="w-full bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
