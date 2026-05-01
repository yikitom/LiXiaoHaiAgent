import ManageSidebar, {
  ManageSegmentedNav,
} from "@/components/manage/ManageSidebar";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
      <ManageSidebar />
      <div className="min-w-0 flex-1">
        <ManageSegmentedNav />
        {children}
      </div>
    </div>
  );
}
