import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth-helper';
import Link from 'next/link';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { LayoutDashboard, FolderKanban, FileText, Files, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session || !session.user) {
    redirect('/login');
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Projeler', icon: FolderKanban },
    ...(session.user.role === 'admin' 
      ? [{ href: '/templates', label: 'Şablonlar', icon: FileText }]
      : []),
    { href: '/documents', label: 'Dokümanlar', icon: Files },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Header with Gradient */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ARGE Platform
              </span>
            </Link>
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 px-3 py-1.5 rounded-lg bg-accent/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{session.user.name}</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      
      {/* Main Content with Modern Spacing */}
      <main className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
