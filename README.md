# ARGE Proje Yazım Platformu

TÜBİTAK, KOSGEB ve Ufuk Avrupa için profesyonel ARGE proje yazım platformu. Yapay zeka destekli proje dokümanları oluşturun ve kurum şablonlarına göre başvurularınızı hazırlayın.

## Özellikler

- 🔐 **Kullanıcı Kimlik Doğrulama**: NextAuth.js v5 ile güvenli giriş sistemi
- 📝 **Şablon Yönetimi**: Admin paneli ile kurum şablonları oluşturma ve yönetme
- 📄 **Doküman Yükleme**: PDF, DOCX, TXT, MD formatlarında doküman yükleme ve işleme
- 🤖 **AI Destekli Yazım**: Google Gemini AI ile otomatik proje içeriği üretimi
- 👥 **İşbirliği**: Ekip üyeleriyle birlikte projeler üzerinde çalışma
- 📊 **Proje Yönetimi**: Proje oluşturma, düzenleme ve takip sistemi

## Teknolojiler

- **Framework**: Next.js 16.0.7 (React 19)
- **Authentication**: NextAuth.js v5
- **Database**: MongoDB (Mongoose)
- **AI**: Google Gemini API
- **UI**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Environment değişkenlerini ayarlayın:
`.env.local` dosyası oluşturun:
```env
MONGODB_URI=mongodb://localhost:27017/projectai
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
GEMINI_API_KEY=your-gemini-api-key-here
```

3. Veritabanını seed edin (örnek kullanıcılar ve şablonlar):
```bash
npm run seed
```

Bu komut şunları oluşturur:
- Admin kullanıcı: `admin@projectai.com` / `admin123`
- Test kullanıcı: `test@projectai.com` / `test123`
- TÜBİTAK, KOSGEB ve Ufuk Avrupa şablonları

4. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

5. Tarayıcıda açın:
```
http://localhost:3000
```

## Kullanım

### İlk Admin Kullanıcısı Oluşturma

MongoDB'de direkt olarak admin kullanıcısı oluşturabilirsiniz veya kayıt olduktan sonra veritabanında `role` alanını `admin` olarak güncelleyebilirsiniz.

### Şablon Oluşturma

1. Admin olarak giriş yapın
2. "Şablonlar" menüsüne gidin
3. "Yeni Şablon" butonuna tıklayın
4. Kurum seçin (TÜBİTAK, KOSGEB, Ufuk Avrupa)
5. Bölümler ve kriterler ekleyin
6. Şablonu kaydedin

### Proje Oluşturma

1. Dashboard'dan "Yeni Proje" butonuna tıklayın
2. Proje bilgilerini girin (başlık, açıklama, kurum, şablon)
3. İsteğe bağlı olarak kaynak dokümanlar yükleyin
4. Projeyi oluşturun
5. Proje düzenleme sayfasında AI ile içerik oluşturun veya manuel yazın

## Proje Yapısı

```
projectai/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth sayfaları
│   ├── (dashboard)/       # Dashboard sayfaları
│   └── api/               # API routes
├── components/            # React component'leri
├── lib/                   # Utility fonksiyonları
├── models/                # MongoDB modelleri
└── types/                 # TypeScript type tanımları
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Projects
- `GET /api/projects` - Proje listesi
- `POST /api/projects` - Yeni proje
- `GET /api/projects/[id]` - Proje detayı
- `PUT /api/projects/[id]` - Proje güncelleme
- `DELETE /api/projects/[id]` - Proje silme

### Templates (Admin)
- `GET /api/templates` - Şablon listesi
- `POST /api/templates` - Yeni şablon
- `PUT /api/templates/[id]` - Şablon güncelleme
- `DELETE /api/templates/[id]` - Şablon silme

### Documents
- `POST /api/documents/upload` - Doküman yükleme
- `GET /api/documents/[id]` - Doküman detayı
- `DELETE /api/documents/[id]` - Doküman silme

### AI
- `POST /api/ai/generate` - Tek bölüm için içerik üretimi
- `POST /api/ai/agent` - Tüm bölümler için içerik üretimi

## Lisans

Bu proje özel bir projedir.
