import 'dotenv/config';
import connectDB from '../lib/mongodb';
import User from '../models/User';
import Template from '../models/Template';
import Project from '../models/Project';
import Document from '../models/Document';
import Collaboration from '../models/Collaboration';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    await connectDB();

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await User.deleteMany({});
    // await Template.deleteMany({});
    // await Project.deleteMany({});
    // await Document.deleteMany({});
    // await Collaboration.deleteMany({});

    // Create admin user
    const adminEmail = 'admin@projectai.com';
    const adminPassword = 'admin123';

    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      adminUser = await User.create({
        email: adminEmail,
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin',
      });
      console.log('✅ Admin user created:', adminEmail);
    } else {
      console.log('ℹ️  Admin user already exists');
      adminUser = await User.findOne({ email: adminEmail });
    }

    // Create test user
    const testEmail = 'test@projectai.com';
    const testPassword = 'test123';

    let testUser = await User.findOne({ email: testEmail });

    if (!testUser) {
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      testUser = await User.create({
        email: testEmail,
        name: 'Test User',
        password: hashedPassword,
        role: 'user',
      });
      console.log('✅ Test user created:', testEmail);
    } else {
      console.log('ℹ️  Test user already exists');
      testUser = await User.findOne({ email: testEmail });
    }

    // Create TÜBİTAK template
    let tubitakTemplate = await Template.findOne({ institution: 'tubitak', name: 'TÜBİTAK 1001 Araştırma Projesi' });

    if (!tubitakTemplate) {
      tubitakTemplate = await Template.create({
        institution: 'tubitak',
        name: 'TÜBİTAK 1001 Araştırma Projesi',
        description: 'TÜBİTAK 1001 programı için araştırma projesi şablonu',
        createdBy: adminUser!._id,
        isActive: true,
        sections: [
          {
            id: 'proje-ozeti',
            title: 'Proje Özeti',
            required: true,
            maxLength: 500,
            format: 'text',
            instructions: 'Projenin kısa bir özetini yazın (maksimum 500 karakter)',
          },
          {
            id: 'proje-amaci',
            title: 'Proje Amacı ve Kapsamı',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Projenin amacını ve kapsamını detaylı olarak açıklayın',
          },
          {
            id: 'literatur-tarama',
            title: 'Literatür Taraması',
            required: true,
            maxLength: 3000,
            format: 'rich-text',
            instructions: 'İlgili literatürü tarayın ve projenin bilimsel temelini oluşturun',
          },
          {
            id: 'metodoloji',
            title: 'Metodoloji',
            required: true,
            maxLength: 3000,
            format: 'rich-text',
            instructions: 'Projede kullanılacak metodolojiyi detaylı olarak açıklayın',
          },
          {
            id: 'beklenen-sonuclar',
            title: 'Beklenen Sonuçlar ve Katkılar',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Projeden beklenen sonuçları ve bilimsel/teknolojik katkıları belirtin',
          },
          {
            id: 'butce',
            title: 'Proje Bütçesi',
            required: true,
            format: 'budget',
            instructions: 'Proje bütçesini detaylı olarak hazırlayın',
          },
        ],
        criteria: [
          {
            title: 'Bilimsel Değer',
            description: 'Projenin bilimsel değeri ve özgünlüğü',
            weight: 30,
          },
          {
            title: 'Metodoloji',
            description: 'Kullanılan metodolojinin uygunluğu ve güvenilirliği',
            weight: 25,
          },
          {
            title: 'Uygulanabilirlik',
            description: 'Projenin uygulanabilirliği ve gerçekleştirilebilirliği',
            weight: 20,
          },
          {
            title: 'Araştırma Ekibi',
            description: 'Araştırma ekibinin yeterliliği ve deneyimi',
            weight: 15,
          },
          {
            title: 'Bütçe',
            description: 'Bütçenin uygunluğu ve gerekçelendirilmesi',
            weight: 10,
          },
        ],
      });
      console.log('✅ TÜBİTAK template created');
    } else {
      console.log('ℹ️  TÜBİTAK template already exists');
    }

    // Create KOSGEB template
    let kosgebTemplate = await Template.findOne({ institution: 'kosgeb', name: 'KOSGEB Ar-Ge ve İnovasyon Desteği' });

    if (!kosgebTemplate) {
      kosgebTemplate = await Template.create({
        institution: 'kosgeb',
        name: 'KOSGEB Ar-Ge ve İnovasyon Desteği',
        description: 'KOSGEB Ar-Ge ve İnovasyon Desteği programı şablonu',
        createdBy: adminUser!._id,
        isActive: true,
        sections: [
          {
            id: 'firma-bilgileri',
            title: 'Firma Bilgileri',
            required: true,
            format: 'text',
            instructions: 'Firma hakkında temel bilgileri girin',
          },
          {
            id: 'proje-ozeti',
            title: 'Proje Özeti',
            required: true,
            maxLength: 1000,
            format: 'text',
            instructions: 'Projenin özetini yazın',
          },
          {
            id: 'proje-konusu',
            title: 'Proje Konusu ve Amacı',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Proje konusunu ve amacını detaylı olarak açıklayın',
          },
          {
            id: 'pazar-analizi',
            title: 'Pazar Analizi',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Hedef pazarı ve rekabet durumunu analiz edin',
          },
          {
            id: 'teknoloji-ve-uretim',
            title: 'Teknoloji ve Üretim Planı',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Kullanılacak teknoloji ve üretim planını açıklayın',
          },
          {
            id: 'butce',
            title: 'Proje Bütçesi',
            required: true,
            format: 'budget',
            instructions: 'Proje bütçesini hazırlayın',
          },
        ],
        criteria: [
          {
            title: 'Yenilikçilik',
            description: 'Projenin yenilikçi yönü',
            weight: 30,
          },
          {
            title: 'Pazar Potansiyeli',
            description: 'Projenin pazar potansiyeli',
            weight: 25,
          },
          {
            title: 'Teknik Uygulanabilirlik',
            description: 'Teknik olarak uygulanabilirliği',
            weight: 25,
          },
          {
            title: 'Firma Kapasitesi',
            description: 'Firmanın projeyi gerçekleştirme kapasitesi',
            weight: 20,
          },
        ],
      });
      console.log('✅ KOSGEB template created');
    } else {
      console.log('ℹ️  KOSGEB template already exists');
    }

    // Create Ufuk Avrupa template
    let ufukTemplate = await Template.findOne({ institution: 'ufuk-avrupa', name: 'Ufuk Avrupa Proje Başvurusu' });

    if (!ufukTemplate) {
      ufukTemplate = await Template.create({
        institution: 'ufuk-avrupa',
        name: 'Ufuk Avrupa Proje Başvurusu',
        description: 'Ufuk Avrupa programı için proje başvuru şablonu',
        createdBy: adminUser!._id,
        isActive: true,
        sections: [
          {
            id: 'executive-summary',
            title: 'Executive Summary',
            required: true,
            maxLength: 2000,
            format: 'text',
            instructions: 'Projenin kısa bir özetini İngilizce yazın',
          },
          {
            id: 'project-objectives',
            title: 'Project Objectives',
            required: true,
            maxLength: 3000,
            format: 'rich-text',
            instructions: 'Proje hedeflerini detaylı olarak açıklayın',
          },
          {
            id: 'work-packages',
            title: 'Work Packages',
            required: true,
            maxLength: 4000,
            format: 'table',
            instructions: 'Çalışma paketlerini tablo formatında hazırlayın',
          },
          {
            id: 'impact',
            title: 'Expected Impact',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Beklenen etkiyi açıklayın',
          },
          {
            id: 'consortium',
            title: 'Consortium',
            required: true,
            maxLength: 2000,
            format: 'rich-text',
            instructions: 'Konsorsiyum yapısını açıklayın',
          },
          {
            id: 'budget',
            title: 'Budget',
            required: true,
            format: 'budget',
            instructions: 'Proje bütçesini hazırlayın',
          },
        ],
        criteria: [
          {
            title: 'Excellence',
            description: 'Scientific and technical excellence',
            weight: 30,
          },
          {
            title: 'Impact',
            description: 'Expected impact',
            weight: 30,
          },
          {
            title: 'Quality and Efficiency',
            description: 'Quality and efficiency of the implementation',
            weight: 20,
          },
          {
            title: 'Consortium',
            description: 'Quality of the consortium',
            weight: 20,
          },
        ],
      });
      console.log('✅ Ufuk Avrupa template created');
    } else {
      console.log('ℹ️  Ufuk Avrupa template already exists');
    }

    // Create sample document
    let sampleDocument = await Document.findOne({ originalName: 'Örnek Proje Fikri.pdf' });

    if (!sampleDocument && testUser) {
      sampleDocument = await Document.create({
        userId: testUser._id,
        filename: 'sample-document.pdf',
        originalName: 'Örnek Proje Fikri.pdf',
        mimeType: 'application/pdf',
        size: 102400, // 100 KB
        storagePath: '/uploads/sample-document.pdf',
        extractedText: 'Bu örnek bir proje fikri dokümanıdır. Yapay zeka destekli sistemlerin geliştirilmesi hakkında bilgiler içermektedir.',
        metadata: {
          pages: 5,
          wordCount: 500,
          language: 'tr',
        },
      });
      console.log('✅ Sample document created');
    } else {
      console.log('ℹ️  Sample document already exists');
    }

    // Create sample project
    let sampleProject = await Project.findOne({ title: 'Örnek TÜBİTAK Projesi' });

    if (!sampleProject && testUser && tubitakTemplate) {
      sampleProject = await Project.create({
        title: 'Örnek TÜBİTAK Projesi',
        description: 'Yapay zeka destekli proje yazım platformu geliştirme projesi',
        templateId: tubitakTemplate._id,
        institution: 'tubitak',
        ownerId: testUser._id,
        collaborators: [],
        content: new Map(),
        sourceDocuments: sampleDocument
          ? [
              {
                documentId: sampleDocument._id,
                uploadedAt: new Date(),
              },
            ]
          : [],
        status: 'draft',
        metadata: {
          budget: 500000,
          duration: 24,
          keywords: ['yapay zeka', 'proje yazımı', 'otomasyon'],
        },
      });
      console.log('✅ Sample project created');
    } else {
      console.log('ℹ️  Sample project already exists');
    }

    // Create sample collaboration activity
    if (sampleProject && testUser) {
      const existingCollaboration = await Collaboration.findOne({
        projectId: sampleProject._id,
        userId: testUser._id,
      });

      if (!existingCollaboration) {
        await Collaboration.create({
          projectId: sampleProject._id,
          userId: testUser._id,
          action: 'create',
          details: {
            message: 'Proje oluşturuldu',
          },
        });
        console.log('✅ Sample collaboration activity created');
      } else {
        console.log('ℹ️  Sample collaboration activity already exists');
      }
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Admin: admin@projectai.com / admin123');
    console.log('   User:  test@projectai.com / test123');
    console.log('\n📊 Created collections:');
    console.log('   ✅ users');
    console.log('   ✅ templates');
    console.log('   ✅ projects');
    console.log('   ✅ documents');
    console.log('   ✅ collaborations');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
