import { Placeholder } from '../components/Placeholder';

export default function ProposalScreen() {
  return (
    <Placeholder
      title="Here's your plan"
      issue="RYR-22"
      links={[
        { label: 'Start this plan', href: '/' },
        { label: 'Tweak', href: '/coach' },
      ]}
    />
  );
}
