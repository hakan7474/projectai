'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UploadIcon, FileIcon, TrashIcon, EditIcon, DownloadIcon, PlusIcon, AlertCircle, Files, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface Document {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  metadata?: {
    wordCount?: number;
    pages?: number;
    language?: string;
  };
  uploadedAt: string;
  isUsed?: boolean;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editName, setEditName] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      } else {
        toast.error('Dokümanlar yüklenemedi');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('text')) return '📃';
    return '📎';
  };

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc);
    setEditName(doc.originalName);
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingDocument || !editName.trim()) {
      toast.error('Dosya adı boş olamaz');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/documents/${editingDocument._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalName: editName.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Doküman güncellenemedi');
      }

      toast.success('Doküman başarıyla güncellendi');
      setShowEditDialog(false);
      setEditingDocument(null);
      fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/${documentToDelete._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Doküman silinemedi');
      }

      toast.success('Doküman başarıyla silindi');
      setShowDeleteDialog(false);
      setDocumentToDelete(null);
      fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (doc: Document) => {
    window.open(`/${doc.storagePath}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Files className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Dokümanlarım
            </h1>
          </div>
          <p className="text-muted-foreground">Yüklediğiniz dokümanları yönetin</p>
          {documents.some(doc => doc.isUsed === false) && (
            <div className="mt-3 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 w-fit">
              <AlertCircle className="h-4 w-4" />
              <span>Turuncu işaretli dokümanlar şablonlarda kullanılmamıştır</span>
            </div>
          )}
        </div>
        <Link href="/documents/upload">
          <Button size="lg" className="gradient-primary text-primary-foreground shadow-modern-lg hover:shadow-modern-lg hover:scale-105 transition-transform">
            <PlusIcon className="mr-2 h-5 w-5" />
            Yeni Doküman Yükle
          </Button>
        </Link>
      </div>

      {documents.length === 0 ? (
        <Card className="border-2 shadow-modern-lg">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Files className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">Henüz doküman yüklenmedi</p>
            <p className="text-sm text-muted-foreground mb-6">İlk dokümanı yükleyerek başlayın</p>
            <Link href="/documents/upload">
              <Button size="lg" className="gradient-primary text-primary-foreground">
                <UploadIcon className="mr-2 h-5 w-5" />
                İlk Dokümanı Yükleyin
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card 
              key={doc._id} 
              className={`group border-2 transition-all duration-300 shadow-modern hover:shadow-modern-lg overflow-hidden ${
                doc.isUsed === false 
                  ? 'border-orange-300 bg-gradient-to-br from-orange-50/50 to-orange-100/30 hover:border-orange-400' 
                  : 'hover:border-primary/50'
              }`}
            >
              <div className={`h-2 ${doc.isUsed === false ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 'bg-gradient-to-r from-primary via-accent to-primary'}`}></div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0 text-2xl">
                      {getFileIcon(doc.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <CardTitle className="text-base font-bold truncate group-hover:text-primary transition-colors" title={doc.originalName}>
                          {doc.originalName}
                        </CardTitle>
                        {doc.isUsed === false && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 shrink-0">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Kullanılmamış
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        {formatFileSize(doc.size)}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  {doc.metadata?.wordCount && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-muted-foreground">Kelime Sayısı</span>
                      <span className="font-bold text-foreground">{doc.metadata.wordCount.toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                  {doc.metadata?.pages && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-muted-foreground">Sayfa Sayısı</span>
                      <span className="font-bold text-foreground">{doc.metadata.pages}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Yüklenme</span>
                    <span className="font-medium text-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:border-primary hover:text-primary transition-colors"
                    onClick={() => handleDownload(doc)}
                  >
                    <DownloadIcon className="mr-1 h-3 w-3" />
                    İndir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:border-primary hover:text-primary transition-colors"
                    onClick={() => handleEdit(doc)}
                  >
                    <EditIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:border-destructive hover:text-destructive transition-colors"
                    onClick={() => handleDeleteClick(doc)}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Doküman Adını Düzenle</DialogTitle>
            <DialogDescription>
              Dokümanın görünen adını değiştirebilirsiniz
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Dosya Adı</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Dosya adını girin"
                disabled={isUpdating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setEditingDocument(null);
              }}
              disabled={isUpdating}
            >
              İptal
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating || !editName.trim()}>
              {isUpdating ? 'Güncelleniyor...' : 'Güncelle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokümanı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{documentToDelete?.originalName}</span> dosyasını silmek istediğinizden emin misiniz?
              Bu işlem geri alınamaz ve dosya kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Siliniyor...' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
