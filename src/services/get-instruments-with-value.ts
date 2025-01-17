import { IInstrument } from "../type/instruments"
import { IResult } from "../type/value-instrument"
import { getInstruments } from "./get-instruments"
import { getValueInstrument } from "./get-value-instrument"

export async function getInstrumentsWithValues() {
  try {
    const instrumentList = await getInstruments()
    const instrumentsWithValue = await Promise.all(
      instrumentList.results.map(async (instrument: IInstrument) => {
        const values = await getValueInstrument(instrument.id)
        if (values.error) {
          return {
            id: instrument.id,
            name: instrument.name || "instrument missing name",
            error: values.error
          } as IInstrument
        }
        const mappedValues = values.results.reduce((acc: Record<string, boolean | number | string | null>, result: IResult) => {
          acc[result.code] = result.values[0].value
          return acc
        }, {})
        return {
          ...instrument,
          ...mappedValues
        }
      })
    )


    return instrumentsWithValue
  } catch (error) {
    console.log(error)
  }
}