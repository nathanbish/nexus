import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { sortTasks, breakdownTask } from '../../../lib/ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { tasks, taskName, action } = req.body

  try {
    if (action === 'sort') {
      const sorted = await sortTasks(tasks)
      return res.json({ tasks: sorted })
    }
    if (action === 'breakdown') {
      const raw = await breakdownTask(taskName)
      const clean = raw.replace(/```json|```/g, '').trim()
      const subtasks = JSON.parse(clean)
      return res.json({ subtasks })
    }
    res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
