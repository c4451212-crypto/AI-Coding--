import { ContractForm } from '@/components/contracts/ContractForm';

export default function NewContractPage() {
  return (
    <div className="space-y-4">
      <ContractForm mode="create" />
    </div>
  );
}
