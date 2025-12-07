'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UploadIcon, FileIcon, XIcon } from 'lucide-react';

export default function UploadDocumentPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Desteklenmeyen dosya tipi. PDF, DOCX, TXT veya MD dosyaları yükleyebilirsiniz.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB\'dan büyük olamaz');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Lütfen bir dosya seçin');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Dosya yüklenemedi');
      }

      toast.success('Doküman başarıyla yüklendi');
      router.push('/documents');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Doküman Yükle</h1>
        <p className="text-gray-600">Proje fikirlerinizi içeren dokümanları yükleyin</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dosya Seç</CardTitle>
          <CardDescription>
            PDF, DOCX, TXT veya MD formatında dosyalar yükleyebilirsiniz (Maks: 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={handleFileInput}
              disabled={isUploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-600">
                Dosyayı buraya sürükleyin veya{' '}
                <span className="text-primary font-medium">tıklayarak seçin</span>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                PDF, DOCX, TXT, MD (Maks: 10MB)
              </p>
            </label>
          </div>

          {selectedFile && (
            <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center space-x-3">
                <FileIcon className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isUploading}>
              İptal
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
              {isUploading ? 'Yükleniyor...' : 'Yükle'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

