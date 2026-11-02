import { Stack } from 'expo-router';

import { WorkloadScreen } from '@/features/admin/workload-screen';

export default function WorkloadRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sitter workload' }} />
      <WorkloadScreen />
    </>
  );
}
