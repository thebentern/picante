/**
 * Minimal WebUSB ambient types (Chrome/Edge). Kept local instead of pulling in
 * @types/w3c-web-usb — only the surface QlPrinter touches.
 *
 * Ported from Meshtastic-Solutions/meshtastic-readyline (GPL-3.0), the same
 * licence as this project.
 */
interface USBDeviceFilter {
  vendorId?: number
  productId?: number
}

interface USBEndpoint {
  endpointNumber: number
  direction: 'in' | 'out'
  type: 'bulk' | 'interrupt' | 'isochronous'
  packetSize: number
}

interface USBAlternateInterface {
  interfaceClass: number
  endpoints: USBEndpoint[]
}

interface USBInterface {
  interfaceNumber: number
  alternates: USBAlternateInterface[]
}

interface USBConfiguration {
  configurationValue: number
  interfaces: USBInterface[]
}

interface USBOutTransferResult {
  bytesWritten: number
  status: 'ok' | 'stall' | 'babble'
}

interface USBInTransferResult {
  data?: DataView
  status: 'ok' | 'stall' | 'babble'
}

interface USBDevice {
  vendorId: number
  productId: number
  productName?: string
  opened: boolean
  configuration: USBConfiguration | null
  configurations: USBConfiguration[]
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(value: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  transferOut(endpointNumber: number, data: ArrayBufferView | ArrayBuffer): Promise<USBOutTransferResult>
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>
}

interface USB {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<USBDevice>
  getDevices(): Promise<USBDevice[]>
}

interface Navigator {
  readonly usb?: USB
}
