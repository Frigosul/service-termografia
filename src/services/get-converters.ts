import { httpInstance } from "../instance";
import { IConverters } from "../type/converters";


export async function getConverters(): Promise<IConverters> {

  const result = await httpInstance('converters')

  return result.data
}