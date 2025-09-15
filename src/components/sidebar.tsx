import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import MainNav from '@/components/main-nav';
import { Logo } from '@/components/logo';

export default function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <MainNav />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        {/* Can add user profile or settings link here */}
      </SidebarFooter>
    </Sidebar>
  );
}
