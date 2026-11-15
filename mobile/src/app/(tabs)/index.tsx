import { Placeholder } from '../../components/Placeholder';

export default function HomeScreen() {
  return (
    <Placeholder
      tab
      title="Home"
      issue="RYR-23"
      links={[
        { label: 'Start onboarding', href: '/onboarding' },
        { label: 'Start workout', href: '/workout' },
        // Dev-only component gallery.
        ...(__DEV__ ? [{ label: 'Component gallery (dev)', href: '/dev/components' as const }] : []),
      ]}
    />
  );
}
