import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateStepPayload, UpdateDevicePayload, UpdateStepPayload } from "@/shared/types";
import { addStep, deleteDevice, deleteStep, updateDevice, updateStep } from "../api/devicesApi";

/** Reloads the device list, and with it every view of the edited device, after a change. */
function useInvalidateDevices() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["devices"] });
}

/** Edit and delete actions for one device and its maintenance steps (#505). */
export function useDeviceEditing(deviceId: number) {
  const invalidate = useInvalidateDevices();

  const updateDeviceMutation = useMutation({
    mutationFn: (payload: UpdateDevicePayload) => updateDevice(deviceId, payload),
    onSuccess: invalidate,
  });
  const deleteDeviceMutation = useMutation({
    mutationFn: () => deleteDevice(deviceId),
    onSuccess: invalidate,
  });
  const addStepMutation = useMutation({
    mutationFn: (payload: CreateStepPayload) => addStep(deviceId, payload),
    onSuccess: invalidate,
  });
  const updateStepMutation = useMutation({
    mutationFn: ({ stepId, payload }: { stepId: number; payload: UpdateStepPayload }) =>
      updateStep(deviceId, stepId, payload),
    onSuccess: invalidate,
  });
  const deleteStepMutation = useMutation({
    mutationFn: (stepId: number) => deleteStep(deviceId, stepId),
    onSuccess: invalidate,
  });

  return {
    updateDevice: updateDeviceMutation,
    deleteDevice: deleteDeviceMutation,
    addStep: addStepMutation,
    updateStep: updateStepMutation,
    deleteStep: deleteStepMutation,
  };
}
