import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../components/TabBar';
import { colors } from '../../theme';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="week" options={{ title: 'Week' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
    </Tabs>
  );
}
