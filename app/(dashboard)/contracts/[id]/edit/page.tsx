import { ContractForm } from '@/components/contracts/ContractForm';

export default function EditContractPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  return (
    <div className="space-y-4">
      <ContractForm mode="edit" contractId={id} />
    </div>
  );
}
