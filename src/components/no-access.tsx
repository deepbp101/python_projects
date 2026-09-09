import { EmptyState } from "@/components/ui";

export function NoAccess({ section }: { section: string }) {
  return (
    <div className="p-5 sm:p-8">
      <EmptyState
        title={`${section} isn't shared with you`}
        description="The couple controls who can see each part of the wedding. Ask them to give you access if you need it."
      />
    </div>
  );
}
