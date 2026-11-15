import { cp, readFile, realpath, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, relative } from 'node:path'

// Overlay only Oussama's reads/tests into a separate S2-09 checkout. No teammate
// production source is copied into or merged with this working branch.
const ownApi = await realpath(fileURLToPath(new URL('..', import.meta.url)))
const target = await realpath(resolve(process.argv[2] ?? ''))
if (target === ownApi || !relative(ownApi, target).startsWith('..')) throw new Error('Supply a separate S2-09 backend checkout, outside this API source tree')
await readFile(`${target}/src/admin/application-revision.ts`)
const modulePath = `${target}/src/app.module.ts`
let module = await readFile(modulePath, 'utf8')
if (!module.includes('AdminApplicationsModule')) {
  if (!module.includes('    AdminModule,')) throw new Error('Unexpected dependency AppModule; inspect before integrating')
  module = "import { AdminApplicationsModule } from './admin-applications/admin-applications.module.js';\n" + module.replace('    AdminModule,', '    AdminModule,\n    AdminApplicationsModule,')
}
await cp(`${ownApi}/src/admin-applications`, `${target}/src/admin-applications`, { recursive: true })
await cp(`${ownApi}/test/admin-applications.e2e-spec.ts`, `${target}/test/admin-applications.e2e-spec.ts`)
await writeFile(modulePath, module)
console.log('Prepared isolated S2-09 backend with your S2-06 reads and integration tests.')
