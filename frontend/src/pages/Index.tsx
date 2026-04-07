import HeroSection from "@/components/home/HeroSection";
import HeroCarousel from "@/components/home/HeroCarousel";
import StatsCards from "@/components/home/StatsCards";
import FeaturesGrid from "@/components/home/FeaturesGrid";
import QuickGuide from "@/components/home/QuickGuide";
import ProfilesSection from "@/components/home/ProfilesSection";
import { usePageSEO } from "@/hooks/usePageSEO";

export default function IndexPage() {
  usePageSEO("/");

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-8 px-4 pt-4 pb-16 sm:px-5 sm:pt-6 md:px-8">
        <HeroSection />
        <StatsCards />
        <HeroCarousel />
        <FeaturesGrid />
        <ProfilesSection />
        <QuickGuide />
      </div>
    </div>
  );
}
