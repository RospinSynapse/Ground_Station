import { phaseRates, operationalModes } from '@/lib/ground/operations';
export default function OperationsReference() {
  return <details className="border rounded p-3">
    <summary>Operational modes and phase schedule — spreadsheet reference</summary>
    <p className="my-2 text-sm">Flight phases and operational modes are different. This reference reproduces the planning sheet; the OBC determines transitions. It does not change flight state or radio timing. SD means onboard storage, TX means transmission.</p>
    <p className="my-2 text-sm">Planning conflicts remain: phase-specific TX intervals versus the 10-minute info packet; 2,028 versus 2,961/~3,000 labels; Safe Mode LoRa OFF versus a one-time entry message. No fixed radio timeout or automatic mode change is inferred.</p>
    <div className="overflow-auto max-h-96"><table className="text-sm w-full"><thead><tr>{['Sensor / data','Ground','Ascent','Float','Descent','Landed'].map(h => <th className="p-2 text-left border" key={h}>{h}</th>)}</tr></thead><tbody>{phaseRates.map(row => <tr key={row.sensor}><th className="p-2 border text-left">{row.sensor}</th>{row.cells.map((cell,i) => <td className="p-2 border min-w-40 max-w-80" key={i}>{cell}</td>)}</tr>)}</tbody></table></div>
    <div className="grid md:grid-cols-2 gap-3 mt-3">{operationalModes.map(mode => <details className="border p-2" key={mode.name}><summary>{mode.name}</summary><ul>{mode.rows.map(row => <li className="my-1 text-sm" key={row.sensor}><strong>{row.sensor}:</strong> {row.activity}</li>)}</ul></details>)}</div>
  </details>;
}
