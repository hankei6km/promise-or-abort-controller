class cancelByTimeoutError extends Error {
  constructor(message: string) {
    //https://stackoverflow.com/questions/41102060/typescript-extending-error-class
    super(message)
    Object.setPrototypeOf(this, cancelByTimeoutError.prototype)
  }
  get reason() {
    return this.message
  }
}

function cancelPromise(timeout: number): [Promise<void>, () => void] {
  let c: () => void
  const p = new Promise<void>((resolve, reject) => {
    c = () => {
      if (id) {
        id = undefined
        clearTimeout(id)
      }
      resolve()
    }
    let id: any = setTimeout(() => {
      id = undefined
      reject(new cancelByTimeoutError('timeout'))
    }, timeout)
  })
  return [p, () => c()]
}

async function proc(timeoutPromise: Promise<void>) {
  let cancelled = false
  timeoutPromise
    .catch((r) => {
      if (r instanceof cancelByTimeoutError) {
        console.log(`catch ${r}`)
      }
    })
    .finally(() => {
      cancelled = true
    })
  // 非同期処理の定義
  const asyncProc = (timeoutPromise: Promise<void>, idx: number) => {
    let id: any
    let pickReject: (r: any) => void
    return Promise.race([
      timeoutPromise,
      new Promise<string>((resolve, reject) => {
        pickReject = reject
        id = setTimeout(() => {
          id = undefined
          resolve(`done ${idx}`)
        }, 100)
      })
    ]).catch((r) => {
      if (r instanceof cancelByTimeoutError) {
        if (id) {
          clearTimeout(id)
          id = undefined
          console.log(`clear ${idx}`)
        }
        pickReject(`cancel resone: ${r.reason} ${idx}`) // race の後なのでこの内容が伝わることはない(クリーンアップ用).
        return Promise.reject(`cancel reasone: ${r.reason} (handler in race)`)
      }
      return Promise.reject(r)
    })
  }
  for (let idx = 0; !cancelled && idx < 10; idx++) {
    // 非同期処理の実行.
    await asyncProc(timeoutPromise, idx)
      .then((v: string | void) => {
        console.log(`then: ${v}`)
      })
      .catch((r: any) => {
        console.log(`catch: ${r}`)
      })
  }
}

{
  console.log('==== start timeout=2000')
  const [timeoutPromise, cancel] = cancelPromise(2000)
  timeoutPromise.catch(() => {
    console.log('---timeout')
  })

  await proc(timeoutPromise)

  cancel()
  console.log('done')
}
console.log('')
{
  console.log('==== start timeout=500')
  const [timeoutPromise, cancel] = cancelPromise(500)
  timeoutPromise.catch(() => {
    console.log('---timeout')
  })

  await proc(timeoutPromise)

  cancel()
  console.log('done')
}

export {}

// $ node --loader ts-node/esm src/chain-in-loop.ts
// ==== start timeout=2000
// then: done 0
// then: done 1
// then: done 2
// then: done 3
// then: done 4
// then: done 5
// then: done 6
// then: done 7
// then: done 8
// then: done 9
// done
//
// ==== start timeout=500
// then: done 0
// then: done 1
// then: done 2
// then: done 3
// ---timeout
// catch Error: timeout
// clear 4
// catch: cancel reasone: timeout (handler in race)
// done
//
